"""
Legacy router compatibility module for document operations.
Forwarding to the unified document_api router.
"""
from app.api.v1.document_api import document_router as router
from app.api.v1.document_api import convert_pdf_to_word, convert_word_to_pdf

__all__ = ["router", "convert_pdf_to_word", "convert_word_to_pdf"]
