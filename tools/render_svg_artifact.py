"""Render SVG accurately with the system librsvg/Cairo libraries, without pip.

PNG exports keep the supplied pixel dimensions. PDF exports retain vector text
and paths and use exact US Letter page dimensions. Requires librsvg 2.46+.
"""
import ctypes as c
from ctypes.util import find_library


class Rectangle(c.Structure):
    _fields_ = [(name, c.c_double) for name in ("x", "y", "width", "height")]


def render_svg(source, target, width, height, pdf=False):
    def library(name):
        path = find_library(name)
        if not path:
            raise RuntimeError(f"Install the system {name} library to render zone plans.")
        return c.CDLL(path)

    rsvg, cairo, gobject = library("rsvg-2"), library("cairo"), library("gobject-2.0")

    def function(lib, name, result, *arguments):
        fn = getattr(lib, name)
        fn.restype = result
        fn.argtypes = list(arguments)
        return fn

    new_svg = function(rsvg, "rsvg_handle_new_from_file", c.c_void_p, c.c_char_p, c.POINTER(c.c_void_p))
    render = function(rsvg, "rsvg_handle_render_document", c.c_int, c.c_void_p, c.c_void_p, c.POINTER(Rectangle), c.POINTER(c.c_void_p))
    image_surface = function(cairo, "cairo_image_surface_create", c.c_void_p, c.c_int, c.c_int, c.c_int)
    pdf_surface = function(cairo, "cairo_pdf_surface_create", c.c_void_p, c.c_char_p, c.c_double, c.c_double)
    context = function(cairo, "cairo_create", c.c_void_p, c.c_void_p)
    write_png = function(cairo, "cairo_surface_write_to_png", c.c_int, c.c_void_p, c.c_char_p)
    finish = function(cairo, "cairo_surface_finish", None, c.c_void_p)
    status = function(cairo, "cairo_surface_status", c.c_int, c.c_void_p)
    destroy_context = function(cairo, "cairo_destroy", None, c.c_void_p)
    destroy_surface = function(cairo, "cairo_surface_destroy", None, c.c_void_p)
    unref = function(gobject, "g_object_unref", None, c.c_void_p)
    error = c.c_void_p()
    handle = new_svg(str(source).encode(), c.byref(error))
    if not handle:
        raise RuntimeError(f"Cannot open SVG: {source}")
    surface = pdf_surface(str(target).encode(), width, height) if pdf else image_surface(0, int(width), int(height))
    ctx = context(surface)
    try:
        viewport = Rectangle(0, 0, width, height)
        if not render(handle, ctx, c.byref(viewport), c.byref(error)):
            raise RuntimeError(f"Cannot render SVG: {source}")
        if not pdf and write_png(surface, str(target).encode()):
            raise RuntimeError(f"Cannot write PNG: {target}")
        finish(surface)
        if status(surface):
            raise RuntimeError(f"Cannot finish artifact: {target}")
    finally:
        destroy_context(ctx)
        destroy_surface(surface)
        unref(handle)
