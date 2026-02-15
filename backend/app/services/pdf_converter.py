"""
PDF to Image Converter.

Converts PDF documents to high-resolution images for OCR processing.
Multimodal LLMs need visual pixel data - they cannot read handwritten text
inside a PDF container directly.
"""
import io
from typing import List, Tuple
from ..logging_config import get_logger

logger = get_logger(__name__)

# Try to import PDF libraries
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    logger.warning("PyMuPDF not installed. PDF support disabled. Install with: pip install pymupdf")

try:
    from pdf2image import convert_from_bytes
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False


def is_pdf_supported() -> bool:
    """Check if PDF conversion is available."""
    return HAS_PYMUPDF or HAS_PDF2IMAGE


def convert_pdf_to_images(
    pdf_bytes: bytes,
    dpi: int = 300,
    max_pages: int = 20,
) -> List[Tuple[bytes, str]]:
    """
    Convert a PDF to high-resolution images.
    
    Args:
        pdf_bytes: Raw PDF file bytes
        dpi: Resolution for conversion (300 DPI recommended for OCR)
        max_pages: Maximum number of pages to convert
        
    Returns:
        List of (image_bytes, mime_type) tuples
        
    Raises:
        ValueError: If PDF conversion is not supported
    """
    if not is_pdf_supported():
        raise ValueError(
            "PDF conversion requires PyMuPDF or pdf2image. "
            "Install with: pip install pymupdf"
        )
    
    images = []
    
    if HAS_PYMUPDF:
        images = _convert_with_pymupdf(pdf_bytes, dpi, max_pages)
    elif HAS_PDF2IMAGE:
        images = _convert_with_pdf2image(pdf_bytes, dpi, max_pages)
    
    logger.info(f"Converted PDF to {len(images)} images at {dpi} DPI")
    return images


def _convert_with_pymupdf(
    pdf_bytes: bytes,
    dpi: int,
    max_pages: int,
) -> List[Tuple[bytes, str]]:
    """Convert PDF using PyMuPDF (faster, no external dependencies)."""
    images = []
    
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for page_num in range(min(len(doc), max_pages)):
        page = doc[page_num]
        
        # Calculate zoom factor for desired DPI (default is 72 DPI)
        zoom = dpi / 72
        mat = fitz.Matrix(zoom, zoom)
        
        # Render page to pixmap
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # Convert to PNG bytes
        png_bytes = pix.tobytes("png")
        images.append((png_bytes, "image/png"))
        
        logger.debug(f"Converted page {page_num + 1}: {pix.width}x{pix.height}")
    
    doc.close()
    return images


def _convert_with_pdf2image(
    pdf_bytes: bytes,
    dpi: int,
    max_pages: int,
) -> List[Tuple[bytes, str]]:
    """Convert PDF using pdf2image (requires poppler)."""
    images = []
    
    pil_images = convert_from_bytes(
        pdf_bytes,
        dpi=dpi,
        first_page=1,
        last_page=max_pages,
    )
    
    for i, img in enumerate(pil_images):
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        images.append((buffer.getvalue(), "image/png"))
        
        logger.debug(f"Converted page {i + 1}: {img.width}x{img.height}")
    
    return images


def get_pdf_page_count(pdf_bytes: bytes) -> int:
    """Get the number of pages in a PDF."""
    if not HAS_PYMUPDF:
        raise ValueError("PyMuPDF required for PDF page counting")
    
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    count = len(doc)
    doc.close()
    return count
