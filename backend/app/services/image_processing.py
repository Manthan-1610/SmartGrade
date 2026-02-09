"""
Image preprocessing pipeline for handwritten document OCR.
Uses OpenCV for deskewing, grayscale conversion, and thresholding.
"""
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import base64


def preprocess_image(image_bytes: bytes) -> tuple[bytes, bytes]:
    """
    Preprocess an image for OCR.
    
    Steps:
    1. Deskew the image (fix rotation angle)
    2. Convert to grayscale
    3. Apply adaptive thresholding (Otsu's binarization)
    
    Args:
        image_bytes: Raw image bytes
        
    Returns:
        Tuple of (processed_image_bytes, original_image_bytes)
    """
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError("Could not decode image")
    
    # Store original for display
    original = img.copy()
    
    # Step 1: Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Step 2: Deskew the image
    deskewed = deskew_image(gray)
    
    # Step 3: Apply adaptive thresholding (Otsu's binarization)
    # First apply Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(deskewed, (5, 5), 0)
    
    # Apply Otsu's thresholding
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Optional: Apply morphological operations to clean up
    kernel = np.ones((1, 1), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    
    # Convert processed image back to bytes
    _, processed_buffer = cv2.imencode('.png', binary)
    processed_bytes = processed_buffer.tobytes()
    
    # Convert original to bytes for storage
    _, original_buffer = cv2.imencode('.png', original)
    original_bytes = original_buffer.tobytes()
    
    return processed_bytes, original_bytes


def deskew_image(gray_img: np.ndarray) -> np.ndarray:
    """
    Deskew a grayscale image by detecting and correcting rotation.
    
    Uses edge detection and Hough transform to find dominant lines
    and calculate the skew angle.
    """
    # Apply edge detection
    edges = cv2.Canny(gray_img, 50, 150, apertureSize=3)
    
    # Use Hough transform to detect lines
    lines = cv2.HoughLinesP(
        edges, 
        rho=1, 
        theta=np.pi/180, 
        threshold=100,
        minLineLength=100,
        maxLineGap=10
    )
    
    if lines is None or len(lines) == 0:
        return gray_img
    
    # Calculate angles of all detected lines
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 - x1 != 0:  # Avoid division by zero
            angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
            # Only consider nearly horizontal lines (within 45 degrees)
            if abs(angle) < 45:
                angles.append(angle)
    
    if not angles:
        return gray_img
    
    # Use median angle to be robust against outliers
    median_angle = np.median(angles)
    
    # Only deskew if angle is significant but not too large
    if abs(median_angle) < 0.5 or abs(median_angle) > 15:
        return gray_img
    
    # Rotate image to correct skew
    (h, w) = gray_img.shape[:2]
    center = (w // 2, h // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    
    # Calculate new bounding box size
    cos = np.abs(rotation_matrix[0, 0])
    sin = np.abs(rotation_matrix[0, 1])
    new_w = int((h * sin) + (w * cos))
    new_h = int((h * cos) + (w * sin))
    
    # Adjust rotation matrix for new size
    rotation_matrix[0, 2] += (new_w / 2) - center[0]
    rotation_matrix[1, 2] += (new_h / 2) - center[1]
    
    # Apply rotation with white background
    rotated = cv2.warpAffine(
        gray_img, 
        rotation_matrix, 
        (new_w, new_h),
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=255
    )
    
    return rotated


def image_to_base64(image_bytes: bytes) -> str:
    """Convert image bytes to base64 string for API transmission."""
    return base64.b64encode(image_bytes).decode('utf-8')


def base64_to_image(base64_str: str) -> bytes:
    """Convert base64 string back to image bytes."""
    return base64.b64decode(base64_str)


def resize_for_api(image_bytes: bytes, max_size: int = 2048) -> bytes:
    """
    Resize image if it's too large for API transmission.
    Maintains aspect ratio.
    """
    img = Image.open(BytesIO(image_bytes))
    
    # Check if resize is needed
    if max(img.size) <= max_size:
        return image_bytes
    
    # Calculate new size maintaining aspect ratio
    ratio = max_size / max(img.size)
    new_size = tuple(int(dim * ratio) for dim in img.size)
    
    # Resize with high quality
    img = img.resize(new_size, Image.Resampling.LANCZOS)
    
    # Convert back to bytes
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()
