# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,missing-class-docstring
# Stdlib:
import asyncio
import json

# Thirdparty:
import pytest

# Firstparty:
import dbgr_server
from dbgr_server.app import init_app, init_versions
from dbgr_server.constants import THEME
from dbgr_server.utils.state import settings as settings_store


class MockResponse:
    def __init__(self, text, status_code=200):
        self._text = text
        self.status_code = status_code

    def json(self):
        if isinstance(self._text, Exception):
            raise self._text
        return json.loads(self._text)


async def test_init_versions(mocker):
    from fastapi import FastAPI  # pylint: disable=import-outside-toplevel
    app = FastAPI()
    remote_version = "future_version"

    mocker.patch(
        "httpx.AsyncClient.get",
        return_value=MockResponse(json.dumps({"info": {"version": remote_version}})),
    )
    await init_versions(app)
    assert app.state.new_version == remote_version
    assert app.state.pypi_version == remote_version
    assert app.state.version == dbgr_server.__version__

    mocker.patch(
        "httpx.AsyncClient.get",
        return_value=MockResponse(
            json.dumps({"info": {"version": dbgr_server.__version__}})
        ),
    )
    await init_versions(app)
    assert app.state.new_version is False
    assert app.state.pypi_version == dbgr_server.__version__
    assert app.state.version == dbgr_server.__version__

    import httpx  # pylint: disable=import-outside-toplevel
    mocker.patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException(""))
    await init_versions(app)
    assert app.state.new_version is False
    assert app.state.pypi_version == "pypi_error"

    mocker.patch(
        "httpx.AsyncClient.get",
        return_value=MockResponse("badvalue"),
    )
    await init_versions(app)
    assert app.state.new_version is False
    assert app.state.pypi_version == "parsing_error"

    mocker.patch("httpx.AsyncClient.get", side_effect=Exception())
    await init_versions(app)
    assert app.state.new_version is False
    assert app.state.pypi_version == "unknown_error"


async def test_init_app():
    test_settings = {
        "debug": True,
        "extra_search_path": True,
        "more": True,
        "show_filename": True,
    }
    app = await init_app(test_settings)
    assert app.state.settings == settings_store
    for key in test_settings:
        assert test_settings[key] == getattr(app.state.settings, key)
    assert app.state.theme == THEME
