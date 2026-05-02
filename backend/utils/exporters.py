from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


BACKEND_DIR = Path(__file__).resolve().parents[1]
PDF_FONT_NAME = "NockturnPdfFont"
PDF_FONT_REGISTERED = False


def build_xlsx_bytes(rows: list[list[str | int | float]]) -> bytes:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""

    app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Nockturn CRM</Application>
</Properties>"""

    created = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Nockturn CRM</dc:creator>
  <cp:lastModifiedBy>Nockturn CRM</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>"""

    def column_name(index: int) -> str:
        result = ""
        current = index
        while current >= 0:
            result = chr(current % 26 + 65) + result
            current = current // 26 - 1
        return result

    sheet_rows: list[str] = []
    for row_index, row in enumerate(rows, start=1):
        cells: list[str] = []
        for column_index, value in enumerate(row):
            cell_ref = f"{column_name(column_index)}{row_index}"
            value_str = escape("" if value is None else str(value))
            cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{value_str}</t></is></c>')
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    worksheet = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    {''.join(sheet_rows)}
  </sheetData>
</worksheet>"""

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as zip_file:
        zip_file.writestr("[Content_Types].xml", content_types)
        zip_file.writestr("_rels/.rels", rels)
        zip_file.writestr("docProps/app.xml", app)
        zip_file.writestr("docProps/core.xml", core)
        zip_file.writestr("xl/workbook.xml", workbook)
        zip_file.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zip_file.writestr("xl/styles.xml", styles)
        zip_file.writestr("xl/worksheets/sheet1.xml", worksheet)

    buffer.seek(0)
    return buffer.getvalue()


def ensure_pdf_font_registered() -> str:
    global PDF_FONT_REGISTERED

    if PDF_FONT_REGISTERED:
        return PDF_FONT_NAME

    font_candidates = [
        BACKEND_DIR / "assets" / "fonts" / "DejaVuSans.ttf",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/calibri.ttf"),
    ]

    for font_path in font_candidates:
        if font_path.exists():
            pdfmetrics.registerFont(TTFont(PDF_FONT_NAME, str(font_path)))
            PDF_FONT_REGISTERED = True
            return PDF_FONT_NAME

    raise RuntimeError(
        "Не удалось найти TTF-шрифт для генерации PDF с кириллицей. "
        "Добавьте DejaVuSans.ttf в backend/assets/fonts."
    )


def build_record_pdf_bytes(
    title: str,
    rows: list[tuple[str, str]],
    generated_at: datetime | None = None,
) -> bytes:
    font_name = ensure_pdf_font_registered()
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    width, height = A4
    left_margin = 50
    top_margin = height - 50
    usable_width = width - left_margin * 2
    y = top_margin

    title_font_size = 16
    text_font_size = 11
    line_gap = 7

    def ensure_space(required_height: float) -> None:
        nonlocal y
        if y - required_height < 50:
            pdf.showPage()
            pdf.setFont(font_name, text_font_size)
            y = top_margin

    pdf.setTitle(title)
    pdf.setAuthor("Nockturn CRM")
    pdf.setFont(font_name, title_font_size)
    pdf.drawString(left_margin, y, title)
    y -= 28

    pdf.setFont(font_name, text_font_size)
    generated_label = (generated_at or datetime.now()).strftime("%d.%m.%Y %H:%M")
    pdf.drawString(left_margin, y, f"Дата формирования: {generated_label}")
    y -= 24

    for label, value in rows:
        value_lines = simpleSplit(str(value), font_name, text_font_size, usable_width)
        block_height = 16 + len(value_lines) * (text_font_size + 2) + line_gap
        ensure_space(block_height)

        pdf.drawString(left_margin, y, f"{label}:")
        y -= 16
        for line in value_lines:
            pdf.drawString(left_margin + 12, y, line)
            y -= text_font_size + 2
        y -= line_gap

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()
