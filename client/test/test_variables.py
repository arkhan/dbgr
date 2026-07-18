# *-* coding: utf-8 *-*
import json

from .conftest import use


@use('variables.py')
def test_watched_auto_locals(socket):
    socket.start()

    assert socket.receive().command == 'Init'
    assert socket.receive().command == 'Title'
    assert socket.receive().command == 'Trace'
    assert socket.receive().command == 'SelectCheck'

    msg = socket.receive()
    assert msg.command == 'Watched'

    # pudb-style: locals are shown automatically, no explicit watch needed.
    assert msg.data.numbers.type == 'list'
    assert msg.data.numbers.expandable is True
    assert msg.data.numbers.len == 3

    assert msg.data.mapping.type == 'dict'
    assert msg.data.mapping.expandable is True
    assert msg.data.mapping.len == 2

    assert msg.data.point.type == 'Point'
    assert msg.data.point.expandable is True
    assert msg.data.point.len == 2  # 2 instance attributes: x, y

    # Scalars stay non-expandable and carry no explicit watch flag.
    assert not msg.data.numbers.get('watch')

    socket.send('Continue')
    socket.join()


@use('variables.py')
def test_expand_list_dict_and_object(socket):
    socket.start()

    assert socket.receive().command == 'Init'
    assert socket.receive().command == 'Title'
    assert socket.receive().command == 'Trace'
    assert socket.receive().command == 'SelectCheck'
    assert socket.receive().command == 'Watched'

    socket.send('Expand', json.dumps({'path': 'numbers'}))
    msg = socket.receive()
    assert msg.command == 'Expanded'
    assert msg.data.path == 'numbers'
    assert '>1</a>' in msg.data.children['0'].val
    assert msg.data.children['0'].path == '(numbers)[0]'
    assert '>3</a>' in msg.data.children['2'].val

    socket.send('Expand', json.dumps({'path': 'mapping'}))
    msg = socket.receive()
    assert msg.command == 'Expanded'
    children = {c.path: c for c in msg.data.children.values()}
    assert "(mapping)['a']" in children
    assert '>1</a>' in children["(mapping)['a']"].val

    socket.send('Expand', json.dumps({'path': 'point'}))
    msg = socket.receive()
    assert msg.command == 'Expanded'
    assert '>1</a>' in msg.data.children['x'].val
    assert msg.data.children['x'].path == '(point).x'
    assert '>2</a>' in msg.data.children['y'].val

    socket.send('Continue')
    socket.join()


@use('variables.py')
def test_setvar_inline_edit(socket):
    socket.start()

    assert socket.receive().command == 'Init'
    assert socket.receive().command == 'Title'
    assert socket.receive().command == 'Trace'
    assert socket.receive().command == 'SelectCheck'
    assert socket.receive().command == 'Watched'

    # Top-level local.
    socket.send('SetVar', json.dumps({'expr': 'point', 'value': 'Point(9, 9)'}))
    msg = socket.receive()
    assert msg.command == 'Watched'
    assert msg.data.point.val == "Point(9, 9)"

    # Nested attribute through a child path.
    socket.send('SetVar', json.dumps({'expr': '(point).x', 'value': '42'}))
    msg = socket.receive()
    assert msg.command == 'Watched'
    assert msg.data.point.val == "Point(42, 9)"

    # Errors are reported without crashing the session.
    socket.send('SetVar', json.dumps({'expr': 'point', 'value': '1 +'}))
    msg = socket.receive()
    assert msg.command == 'Echo'
    assert msg.data['for'] == 'SetVar'

    socket.send('Continue')
    socket.join()
