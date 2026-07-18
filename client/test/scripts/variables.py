import dbgr


class Point(object):
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return 'Point(%r, %r)' % (self.x, self.y)


def work():
    numbers = [1, 2, 3]
    mapping = {'a': 1, 'b': 2}
    point = Point(1, 2)
    dbgr.set_trace()
    print(numbers, mapping, point)


work()
