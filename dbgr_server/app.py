# Stdlib:
import asyncio
import logging
import mimetypes
import sys
from contextlib import asynccontextmanager
from json import JSONDecodeError
from typing import Any, Dict, Optional

# Register font MIME types missing from some system mimetypes databases
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")
mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("font/eot", ".eot")

# Thirdparty:
import httpx
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Firstparty:
import dbgr_server
from dbgr_server.constants import PROJECT_DIR, THEME
from dbgr_server.routes import router
from dbgr_server.utils.state import settings as settings_store
from dbgr_server.utils.technical import LibPythonWatcher


async def init_versions(app: FastAPI) -> None:
    async with httpx.AsyncClient(timeout=1) as client:
        try:
            resp = await client.get("https://pypi.org/pypi/dbgr-server/json")
            info = resp.json()
            pypi_version = info["info"]["version"]
            app.state.pypi_version = pypi_version
        except httpx.TimeoutException:
            app.state.pypi_version = "pypi_error"
        except (JSONDecodeError, KeyError):
            app.state.pypi_version = "parsing_error"
        except Exception:  # pylint: disable=broad-except
            app.state.pypi_version = "unknown_error"

    app.state.version = dbgr_server.__version__
    new_version: Any = False
    if app.state.pypi_version not in (
        "pypi_error",
        "parsing_error",
        "unknown_error",
        app.state.version,
    ):
        new_version = app.state.pypi_version
    app.state.new_version = new_version


def create_templates() -> Jinja2Templates:
    templates = Jinja2Templates(directory=str(PROJECT_DIR / "templates"))

    def asset(path: str) -> str:
        """Static URL with a mtime query string so browsers refetch after a rebuild."""
        rel = path.lstrip("/")
        try:
            version = int((PROJECT_DIR / "static" / rel).stat().st_mtime)
        except OSError:
            version = 0
        return f"/static/{rel}?v={version}"

    templates.env.globals.update(
        static=lambda path: f"/static{path}",
        asset=asset,
        url=lambda route, **kwargs: (
            f"/static/{kwargs.get('filename', '')}"
            if route == "static"
            else "/"
        ),
    )
    return templates


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    socket_host: str = getattr(app.state, "socket_host", "localhost")
    socket_port: Optional[int] = getattr(app.state, "socket_port", None)

    if not socket_port:
        yield
        return

    from dbgr_server.utils.streams import handle_tcp_connection  # pylint: disable=import-outside-toplevel

    tcp_server = await asyncio.start_server(
        handle_tcp_connection, socket_host, socket_port
    )
    async with tcp_server:
        tcp_server_task = asyncio.ensure_future(tcp_server.serve_forever())
        try:
            yield
        finally:
            tcp_server_task.cancel()
            try:
                await tcp_server_task
            except asyncio.CancelledError:
                pass


async def init_app(settings: Optional[Dict[str, Any]] = None) -> FastAPI:
    if settings is None:
        settings = {}

    if LibPythonWatcher:  # pragma: no cover
        LibPythonWatcher(
            sys.base_prefix if settings.get("extra_search_path") else None
        )

    app = FastAPI(lifespan=lifespan)

    settings_store.update(**{
        k: v for k, v in settings.items()
        if k in ("debug", "extra_search_path", "more", "detached_session", "show_filename")
    })
    app.state.settings = settings_store
    app.state.socket_host = settings.get("socket_host", "localhost")
    app.state.socket_port = settings.get("socket_port", None)

    logging.basicConfig(level=logging.DEBUG)
    await init_versions(app)
    app.state.theme = THEME

    templates = create_templates()
    app.state.templates = templates

    app.include_router(router)
    app.mount(
        "/static",
        StaticFiles(directory=str(PROJECT_DIR / "static")),
        name="static",
    )

    return app
