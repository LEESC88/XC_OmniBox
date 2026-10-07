"""
Backward compatibility proxy module.
PDF to Word conversion functionality has been consolidated into app.services.pdf_service.
"""
from app.services.pdf_service import PdfService, PdfToWordService

__all__ = ["PdfService", "PdfToWordService"]
