# pylint: disable=protected-access,missing-function-docstring,invalid-name

# Stdlib:
import json

# Thirdparty:
from mock import call

# Firstparty:
from dbgr_server.utils.state import (
    Breakpoints,
    Sockets,
    WebSockets,
    sockets,
    websockets,
)
from dbgr_server.views import BaseWebSocketHandler


def test_open_close(mocker, client, dummy_websocket, dummy_socket):
    mocker.patch("dbgr_server.utils.state.WebSockets.send")
    mocker.patch("dbgr_server.utils.state.WebSockets.close")
    mocker.patch("dbgr_server.utils.state.Sockets.send")
    mocker.patch("dbgr_server.utils.state.Sockets.close")

    def clean_mocks():
        WebSockets.send.reset_mock()
        WebSockets.close.reset_mock()
        Sockets.send.reset_mock()
        Sockets.close.reset_mock()

    test_uuid = "test_uuid"

    # uuid in websockets and not in sockets
    clean_mocks()
    websockets._sockets = {test_uuid: dummy_websocket}
    sockets._sockets = {}
    assert test_uuid in websockets.uuids
    assert test_uuid not in sockets.uuids
    with client.websocket_connect(f"/websocket/{test_uuid}"):
        pass
    WebSockets.send.assert_called_once_with(test_uuid, "Die")
    WebSockets.close.assert_called_once_with(test_uuid)

    # uuid in websockets and in sockets
    clean_mocks()
    websockets._sockets = {test_uuid: dummy_websocket}
    sockets._sockets = {test_uuid: dummy_socket}
    assert test_uuid in websockets.uuids
    assert test_uuid in sockets.uuids

    with client.websocket_connect(f"/websocket/{test_uuid}"):
        pass
    WebSockets.send.assert_called_once_with(test_uuid, "Die")

    # uuid not in websockets and in sockets
    clean_mocks()
    websockets._sockets = {}
    sockets._sockets = {test_uuid: dummy_socket}
    assert test_uuid not in websockets.uuids
    assert test_uuid in sockets.uuids

    with client.websocket_connect(f"/websocket/{test_uuid}"):
        pass
    WebSockets.send.assert_not_called()
    WebSockets.close.assert_not_called()
    Sockets.send.assert_called_once_with(test_uuid, "Close")
    Sockets.close.assert_called_once_with(test_uuid)


def test_on_message(mocker, client, dummy_socket):
    mocker.patch("dbgr_server.utils.state.WebSockets.send")
    mocker.patch("dbgr_server.utils.state.Sockets.broadcast")
    mocker.patch("dbgr_server.utils.state.Sockets.send")
    test_uuid = "test_uuid_2"

    def clean_mocks():
        Sockets.broadcast.reset_mock()
        Sockets.send.reset_mock()

    def send_to_websocket(cmd, message=None):
        data = f"{cmd}|{message}" if message is not None else cmd
        with client.websocket_connect(f"/websocket/{test_uuid}") as ws:
            clean_mocks()
            ws.send_text(data)

    clean_mocks()
    message = "message"
    sockets._sockets = {test_uuid: dummy_socket}
    assert test_uuid in sockets.uuids
    send_to_websocket(message)
    Sockets.broadcast.assert_not_called()
    assert Sockets.send.mock_calls == [
        call(test_uuid, message),
        call(test_uuid, "Close"),
    ]

    clean_mocks()
    message = "message"
    sockets._sockets = {test_uuid: dummy_socket}
    assert test_uuid in sockets.uuids
    send_to_websocket("Broadcast", message)
    Sockets.broadcast.assert_called_once_with(message)
    Sockets.send.assert_called_once_with(test_uuid, "Close")


def test_write(mocker, client, dummy_socket):
    mocker.patch("dbgr_server.utils.state.WebSockets.add")
    mocker.patch("dbgr_server.views.BaseWebSocketHandler.write_message")
    mocker.patch("dbgr_server.utils.state.Breakpoints.add")
    mocker.patch("dbgr_server.utils.state.Breakpoints.remove")

    def clean_mocks():
        WebSockets.add.reset_mock()
        BaseWebSocketHandler.write_message.reset_mock()
        Breakpoints.add.reset_mock()
        Breakpoints.remove.reset_mock()

    test_uuid = "test_uuid3"
    sockets._sockets = {test_uuid: dummy_socket}
    assert test_uuid in sockets.uuids
    with client.websocket_connect(f"/websocket/{test_uuid}"):
        instance = WebSockets.add.call_args[0][1]
        # Random message
        message = "message"
        # write() is async; run via asyncio.run() from sync context
        import asyncio  # pylint: disable=import-outside-toplevel
        asyncio.run(instance.write(message))
        BaseWebSocketHandler.write_message.assert_called_once_with(message)
        Breakpoints.add.assert_not_called()
        Breakpoints.remove.assert_not_called()

        # BreakSet
        clean_mocks()
        breakpoint1 = {"data": "breakpoint1", "temporary": None}
        breakpoint2 = {"data": "breakpoint1", "temporary": True}
        message = f"BreakSet|{json.dumps(breakpoint1)}"
        asyncio.run(instance.write(message))
        BaseWebSocketHandler.write_message.assert_called_once_with(message)
        Breakpoints.add.assert_called_once_with({"data": breakpoint1["data"]})
        Breakpoints.remove.assert_not_called()
        clean_mocks()
        message = f"BreakSet|{json.dumps(breakpoint2)}"
        asyncio.run(instance.write(message))
        BaseWebSocketHandler.write_message.assert_called_once_with(message)
        Breakpoints.add.assert_not_called()
        Breakpoints.remove.assert_not_called()

        # BreakUnset
        clean_mocks()
        message = f"BreakUnset|{json.dumps(breakpoint1)}"
        asyncio.run(instance.write(message))
        BaseWebSocketHandler.write_message.assert_called_once_with(message)
        Breakpoints.add.assert_not_called()
        Breakpoints.remove.assert_called_once_with(
            {"data": breakpoint1["data"]}
        )
        clean_mocks()
        message = f"BreakUnset|{json.dumps(breakpoint2)}"
        asyncio.run(instance.write(message))
        BaseWebSocketHandler.write_message.assert_called_once_with(message)
        Breakpoints.add.assert_not_called()
        Breakpoints.remove.assert_not_called()
