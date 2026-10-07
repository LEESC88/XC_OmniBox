"""
Legacy router compatibility module for PDF operations.
Forwarding to the unified document_api router.
"""
from app.api.v1.document_api import pdf_router as router
from app.api.v1.document_api import (
    compress_pdf,
    images_to_pdf,
    merge_pdfs,
    organize_pdf,
    protect_pdf,
    split_pdf,
    unlock_pdf,
    add_watermark,
)

watermark_pdf = add_watermark

__all__ = [
    "router",
    "merge_pdfs",
    "split_pdf",
    "add_watermark",
    "watermark_pdf",
    "protect_pdf",
    "unlock_pdf",
    "compress_pdf",
    "images_to_pdf",
    "organize_pdf",
]
