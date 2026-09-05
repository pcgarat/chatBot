"""FIFO de entradas de debug: el más antiguo sale al superar el máximo."""


def create_debug_log_buffer(get_max_size):
    items = []

    def max_size():
        n = get_max_size() if callable(get_max_size) else get_max_size
        try:
            parsed = int(n)
        except (TypeError, ValueError):
            parsed = 1
        return max(1, parsed)

    def trim():
        limit = max_size()
        while len(items) > limit:
            items.pop(0)

    def push(entry):
        items.append(entry)
        trim()
        return entry

    return push, lambda: list(items), trim


def test_fifo_drops_oldest_when_over_capacity():
    size = 3
    push, listing, _trim = create_debug_log_buffer(lambda: size)
    for i in range(5):
        push({"id": i})
    ids = [e["id"] for e in listing()]
    assert ids == [2, 3, 4]


def test_fifo_trim_applies_new_smaller_max():
    size = {"n": 5}
    push, listing, trim = create_debug_log_buffer(lambda: size["n"])
    for i in range(5):
        push({"id": i})
    size["n"] = 2
    trim()
    assert [e["id"] for e in listing()] == [3, 4]


def test_fifo_rejects_non_positive_max():
    push, listing, _trim = create_debug_log_buffer(lambda: 0)
    push({"id": 1})
    push({"id": 2})
    assert [e["id"] for e in listing()] == [2]
