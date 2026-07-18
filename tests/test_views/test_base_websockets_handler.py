# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,invalid-name

# Thirdparty:
import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient
from starlette.websockets import WebSocket

# Firstparty:
from dbgr_server.views import BaseWebSocketHandler


@pytest.fixture
def client_ws():
    mini_app = FastAPI()

    @mini_app.websocket("/base_ws")
    async def base_ws_endpoint(websocket: WebSocket):
        handler = BaseWebSocketHandler(websocket)
        await handler.get()

    with TestClient(mini_app) as tc:
        yield tc


def test_open_close(mocker, client_ws):
    mocker.patch("dbgr_server.views.BaseWebSocketHandler.on_open")
    mocker.patch("dbgr_server.views.BaseWebSocketHandler.on_message")
    mocker.patch("dbgr_server.views.BaseWebSocketHandler.on_close")
    data = "data"
    with client_ws.websocket_connect("/base_ws") as ws:
        assert BaseWebSocketHandler.on_open.call_count == 1
        BaseWebSocketHandler.on_message.assert_not_called()
        ws.send_text(data)
        BaseWebSocketHandler.on_close.assert_not_called()
    BaseWebSocketHandler.on_message.assert_called_with(data)
    BaseWebSocketHandler.on_close.assert_called()
