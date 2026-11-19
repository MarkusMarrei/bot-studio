import io
import csv
from pathlib import Path
from typing import Dict, Any, List

def parse_document(filename: str, file_bytes: bytes) -> Dict[str, Any]:
    """
    Parses uploaded knowledge documents into structured text for RAG.
    Supports .md, .txt, .pdf, .docx, .xlsx, .csv.
    Zero external server dependencies (uses standard installed libraries).
    """
    ext = Path(filename).suffix.lower()
    text = ""

    try:
        if ext in [".txt", ".md", ".markdown"]:
            text = file_bytes.decode("utf-8", errors="ignore")

        elif ext == ".pdf":
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages = []
            for idx, page in enumerate(reader.pages):
                extracted = page.extract_text() or ""
                if extracted.strip():
                    pages.append(f"--- Страница {idx + 1} ---\n{extracted.strip()}")
            text = "\n\n".join(pages)

        elif ext in [".docx", ".doc"]:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            
            # Also extract tables from docx if any
            table_texts = []
            for t_idx, table in enumerate(doc.tables):
                table_texts.append(f"--- Таблица {t_idx + 1} ---")
                for row in table.rows:
                    row_vals = [cell.text.strip() for cell in row.cells]
                    table_texts.append(" | ".join(row_vals))
            
            text = "\n\n".join(paragraphs + table_texts)

        elif ext in [".xlsx", ".xls"]:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            lines = []
            for sheetname in wb.sheetnames:
                ws = wb[sheetname]
                lines.append(f"=== Лист: {sheetname} ===")
                for row in ws.iter_rows(values_only=True):
                    if any(row):
                        cells = [str(c) if c is not None else "" for c in row]
                        lines.append(" | ".join(cells))
            text = "\n".join(lines)

        elif ext == ".csv":
            decoded = file_bytes.decode("utf-8", errors="ignore")
            reader = csv.reader(io.StringIO(decoded))
            rows = [" | ".join(r) for r in reader if any(r)]
            text = "\n".join(rows)

        else:
            text = file_bytes.decode("utf-8", errors="ignore")

    except Exception as e:
        text = f"[Ошибка чтения файла {filename}: {str(e)}]"

    cleaned_text = text.strip()
    return {
        "filename": filename,
        "extension": ext,
        "char_count": len(cleaned_text),
        "text": cleaned_text,
        "preview": cleaned_text[:300] + ("..." if len(cleaned_text) > 300 else "")
    }
