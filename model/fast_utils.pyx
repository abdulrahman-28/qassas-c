# fast_utils.pyx

cpdef long long stable_int(str text):
    cdef long long value = 0
    cdef bytes text_bytes = text.encode('utf-8')
    cdef char c
    for c in text_bytes:
        value = (value * 131 + c) % 1000000007
    return value
