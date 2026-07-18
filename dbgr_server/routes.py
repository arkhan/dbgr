# Thirdparty:
from fastapi import APIRouter

# Firstparty:
from dbgr_server.views import (
    debug_get,
    debug_post_form,
    home_get,
    main_get,
    status_ws,
    websocket_ws,
)

router = APIRouter()

router.add_api_route("/", home_get, methods=["GET"])
router.add_api_route("/{type_}/session/{uuid}", main_get, methods=["GET"])
router.add_api_route("/debug/file/{fn:path}", debug_get, methods=["GET"])
router.add_api_route("/debug/file/{fn:path}", debug_post_form, methods=["POST"])
router.add_api_route("/debug/file/", debug_post_form, methods=["POST"])
router.add_api_websocket_route("/websocket/{uuid}", websocket_ws)
router.add_api_websocket_route("/status", status_ws)
