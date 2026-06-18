from setuptools import setup
from Cython.Build import cythonize

setup(
    name="fast_utils",
    ext_modules=cythonize(
        "fast_utils.pyx", compiler_directives={"language_level": "3"}
    ),
    packages=[],
    py_modules=[],
)
