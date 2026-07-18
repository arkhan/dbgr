# pylint: disable=unused-argument,missing-function-docstring
# Stdlib:
import asyncio
import multiprocessing
from typing import Any

# Thirdparty:
import mock
import pytest
from starlette.testclient import TestClient

# Firstparty:
from dbgr_server.app import init_app


@pytest.fixture
def app():
    return asyncio.run(init_app({}))


@pytest.fixture
def client(app):
    """TestClient for HTTP and WebSocket tests."""
    with TestClient(app, follow_redirects=True) as tc:
        yield tc


class DummySocket:
    """Test class for represent any real socket"""

    async def close(self):
        ...

    async def write(self, data: Any):
        ...


class DummyWebSocket(DummySocket):
    """Test class for represent any real websocket"""

    async def write_message(self, message: str):
        ...


@pytest.fixture
def dummy_socket():
    return DummySocket()


@pytest.fixture
def dummy_websocket():
    return DummyWebSocket()


@pytest.fixture()
def Process___init__():  # pylint: disable=invalid-name
    with mock.patch.object(
        multiprocessing.Process, "__init__", return_value=None
    ) as mock_method:
        yield mock_method


@pytest.fixture()
def Process_start():  # pylint: disable=invalid-name
    with mock.patch.object(
        multiprocessing.Process, "start", return_value=None
    ) as mock_method:
        yield mock_method


@pytest.fixture()
def create_subprocess_exec():
    with mock.patch.object(
        asyncio, "create_subprocess_exec", return_value=None
    ) as mock_method:
        yield mock_method
