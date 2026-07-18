# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,invalid-name
# Stdlib:
from uuid import uuid4


def test_main_get(client):
    unknown_type = "unknown"
    bad_uuid = "bad_uuid"

    resp = client.get(f"/{unknown_type}/session/{uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == f"type_ {unknown_type} Not Found"

    resp = client.get(f"/debug/session/{bad_uuid}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Not Found"

    type_ = "debug"
    uuid = uuid4()
    resp = client.get(f"/{type_}/session/{uuid}")
    assert resp.status_code == 200
    text = resp.text
    assert f'<body data-debug="true" data-type="{type_}">' in text
    assert (
        '<div class="trace mdl-layout mdl-js-layout mdl-layout--fixed-header"'
        f' data-uuid="{uuid}">' in text
    )
