# pylint: disable=missing-function-docstring
# Stdlib:
import asyncio
import json
import logging
import multiprocessing
import os
import re
from typing import Optional
from uuid import uuid4

# Thirdparty:
from fastapi import Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from starlette.websockets import WebSocket, WebSocketDisconnect

# Firstparty:
from dbgr_server.constants import UNKNOWN_UUID, UUID_REGEXP, DBGR_TYPES
from dbgr_server.utils.state import (
    breakpoints,
    settings,
    sockets,
    syncwebsockets,
    websockets,
)
from dbgr_server.utils.technical import LibPythonWatcher, refresh_process

log = logging.getLogger("dbgr_server")


async def self_shell() -> None:  # pragma: no cover
    import dbgr  # pylint: disable=import-outside-toplevel

    dbgr.set_trace()  # pylint: disable=no-member


async def run_shell() -> None:  # pragma: no cover
    from dbgr import Dbgr  # pylint: disable=import-outside-toplevel

    Dbgr.get().shell()


async def run_file(file_name: str) -> None:  # pragma: no cover
    from dbgr import Dbgr  # pylint: disable=import-outside-toplevel

    Dbgr.get().run_file(file_name)


# ---------------------------------------------------------------------------
# HTTP handlers
# ---------------------------------------------------------------------------

def _get_templates(request: Request) -> Jinja2Templates:
    return request.app.state.templates  # type: ignore[no-any-return]


async def home_get(request: Request) -> "TemplateResponse":  # type: ignore[name-defined]
    templates = _get_templates(request)
    return templates.TemplateResponse(
        request,
        "home.html",
        context={
            "settings": request.app.state.settings,
            "theme": request.app.state.theme,
            "type_": "home",
            "handler_name": "HomeHandler",
        },
    )


async def main_get(request: Request, type_: str, uuid: str) -> "TemplateResponse":  # type: ignore[name-defined]
    if type_ not in DBGR_TYPES:
        raise HTTPException(status_code=404, detail=f"type_ {type_} Not Found")
    if not re.fullmatch(UUID_REGEXP, uuid):
        raise HTTPException(status_code=404, detail="Not Found")
    templates = _get_templates(request)
    return templates.TemplateResponse(
        request,
        "wdb.html",
        context={
            "uuid": uuid,
            "new_version": request.app.state.new_version,
            "type_": type_,
            "settings": request.app.state.settings,
            "theme": request.app.state.theme,
            "handler_name": "MainHandler",
        },
    )


def _debug(fnc: str) -> RedirectResponse:
    multiprocessing.Process(target=run_file, args=(fnc,)).start()
    return RedirectResponse("/", status_code=302)


async def debug_get(fn: str) -> RedirectResponse:
    return _debug(fn)


async def debug_post_form(
    fn: str = "",
    debug_file: Optional[str] = Form(None),
) -> RedirectResponse:
    target = debug_file or fn
    if target:
        return _debug(target)
    raise HTTPException(status_code=400, detail="No file specified")


# ---------------------------------------------------------------------------
# WebSocket handlers
# ---------------------------------------------------------------------------

class BaseWebSocketHandler:
    uuid: str = UNKNOWN_UUID

    def __init__(self, ws: WebSocket) -> None:
        self.ws = ws

    async def write_message(self, message: str) -> None:
        await self.ws.send_text(message)

    async def write(self, message: str) -> None:
        raise NotImplementedError

    async def on_open(self) -> None:
        raise NotImplementedError

    async def on_message(self, message: str) -> None:
        raise NotImplementedError

    async def close(self) -> None:
        try:
            await self.ws.close()
        except Exception:  # pylint: disable=broad-except
            pass

    async def on_close(self) -> None:
        raise NotImplementedError

    async def get(self) -> None:
        await self.ws.accept()
        await self.on_open()
        try:
            while True:
                try:
                    data = await self.ws.receive_text()
                    await self.on_message(data)
                except WebSocketDisconnect:
                    break
        finally:
            await self.on_close()


class SyncWebSocketHandler(BaseWebSocketHandler):
    async def write(self, message: str) -> None:
        log.debug("server -> syncsocket: %s", message)
        await self.write_message(message)

    async def on_open(self) -> None:
        self.uuid = str(uuid4())
        await syncwebsockets.add(self.uuid, self)
        if not LibPythonWatcher:
            await syncwebsockets.send(self.uuid, "StartLoop")

    # pylint: disable=too-many-branches
    async def on_message(self, message: str) -> None:
        if "|" in message:
            cmd, data = message.split("|", 1)
        else:
            cmd, data = message, ""

        if cmd == "ListSockets":
            for uuid in sockets.uuids:
                await syncwebsockets.send(
                    self.uuid,
                    "AddSocket",
                    {
                        "uuid": uuid,
                        "filename": sockets.get_filename(uuid)
                        if settings.show_filename
                        else "",
                    },
                )
        elif cmd == "ListWebsockets":
            for uuid in websockets.uuids:
                await syncwebsockets.send(self.uuid, "AddWebSocket", uuid)
        elif cmd == "ListBreaks":
            for brk in breakpoints.get():
                await syncwebsockets.send(self.uuid, "AddBreak", brk)
        elif cmd == "RemoveBreak":
            brk = json.loads(data)
            await breakpoints.remove(brk)
            brk["temporary"] = False
            await sockets.broadcast("Unbreak", brk)
        elif cmd == "RemoveUUID":
            await sockets.close(data)
            await sockets.remove(data)
            await websockets.close(data)
            await websockets.remove(data)
        elif cmd == "ListProcesses":
            await refresh_process(self.uuid)
        elif cmd == "Pause":
            if int(data) == os.getpid():
                log.debug("Pausing self")
                multiprocessing.Process(target=self_shell).start()
            else:
                log.debug("Pausing %s", data)
                command = ["gdb", "-p", data, "-batch"] + [
                    f"-eval-command=call {hook}"
                    for hook in [
                        "PyGILState_Ensure()",
                        "PyRun_SimpleString("
                        '"import dbgr; dbgr.set_trace(skip=1)"'
                        ")",
                        "PyGILState_Release($1)",
                    ]
                ]
                await asyncio.create_subprocess_exec(
                    *command,
                    stdin=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
        elif cmd == "RunFile":
            multiprocessing.Process(target=run_file, args=(data,)).start()
        elif cmd == "RunShell":
            multiprocessing.Process(target=run_shell).start()

    async def on_close(self) -> None:
        await syncwebsockets.remove(self.uuid)


class WebSocketHandler(BaseWebSocketHandler):
    async def write(self, message: str) -> None:
        log.debug("socket -> websocket: %s", message)
        if message.startswith("BreakSet|") or message.startswith("BreakUnset|"):
            log.debug("Intercepted break")
            cmd, _brk = message.split("|", 1)
            brk = json.loads(_brk)
            if not brk["temporary"]:
                del brk["temporary"]
                if cmd == "BreakSet":
                    await breakpoints.add(brk)
                elif cmd == "BreakUnset":
                    await breakpoints.remove(brk)

        await self.write_message(message)

    async def on_open(self) -> None:
        if self.uuid in websockets.uuids:
            log.warning(
                "Websocket already opened for %s. Closing previous one",
                self.uuid,
            )
            await websockets.send(self.uuid, "Die")
            await websockets.close(self.uuid)

        if self.uuid not in sockets.uuids:
            log.warning(
                "Websocket opened for %s with no corresponding socket",
                self.uuid,
            )
            await sockets.send(self.uuid, "Die")
            await self.on_close()
            return

        log.info("Websocket opened for %s", self.uuid)
        await websockets.add(self.uuid, self)

    async def on_message(self, message: str) -> None:
        log.debug("websocket -> socket: %s", message)
        if message.startswith("Broadcast|"):
            message = message.split("|", 1)[1]
            await sockets.broadcast(message)
        else:
            await sockets.send(self.uuid, message)

    async def on_close(self) -> None:
        log.info("Websocket closed for %s", self.uuid)
        if not settings.detached_session:
            await sockets.send(self.uuid, "Close")
            await sockets.close(self.uuid)


# ---------------------------------------------------------------------------
# FastAPI WebSocket endpoints
# ---------------------------------------------------------------------------

async def status_ws(websocket: WebSocket) -> None:
    handler = SyncWebSocketHandler(websocket)
    await handler.get()


async def websocket_ws(websocket: WebSocket, uuid: str) -> None:
    handler = WebSocketHandler(websocket)
    handler.uuid = uuid
    await handler.get()
