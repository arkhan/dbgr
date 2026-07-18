# pylint: disable=missing-function-docstring,redefined-outer-name
# pylint: disable=protected-access,no-member,invalid-name


def test_home_get(client):
    resp = client.get("/")
    assert resp.status_code == 200

