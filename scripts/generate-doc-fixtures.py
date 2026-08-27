#!/usr/bin/env python3
# cspell:disable
"""Generate minimal binary fixtures for documents normalizer tests.

Produces:
  packages/core/tests/fixtures/sample.pdf   (minimal PDF with a text layer)
  packages/core/tests/fixtures/sample.docx  (minimal docx with Heading1 + paragraph)
  packages/core/tests/fixtures/sample.epub  (minimal epub with two chapters)

Deterministic output: fixed zip timestamps, computed PDF xref offsets.
Run: python3 scripts/generate-doc-fixtures.py
"""

import io
import os
import zipfile

FIXTURES = os.path.join(
    os.path.dirname(__file__), "..", "packages", "core", "tests", "fixtures"
)


def build_pdf() -> bytes:
    stream = b"BT /F1 24 Tf 72 720 Td (Hello Agent Engine PDF) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
        ),
        (
            b"<< /Length "
            + str(len(stream)).encode()
            + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        ),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    header = b"%PDF-1.4\n"
    body = bytearray()
    offsets = []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(header) + len(body))
        body += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"

    xref_offset = len(header) + len(body)
    xref = f"xref\n0 {len(objects) + 1}\n".encode()
    xref += b"0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n".encode()
    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF".encode()
    )
    return header + bytes(body) + xref + trailer


def build_docx() -> bytes:
    content_types = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        b'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        b'<Default Extension="xml" ContentType="application/xml"/>'
        b'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        b"</Types>"
    )
    rels = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        b'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        b"</Relationships>"
    )
    document = (
        b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        b'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        b"<w:body>"
        b'<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Agent Engine</w:t></w:r></w:p>'
        b"<w:p><w:r><w:t>This is a docx fixture.</w:t></w:r></w:p>"
        b"</w:body></w:document>"
    )
    buf = _zip(
        [
            ("[Content_Types].xml", content_types),
            ("_rels/.rels", rels),
            ("word/document.xml", document),
        ]
    )
    return buf


def build_epub() -> bytes:
    mimetype = b"application/epub+zip"
    container = (
        b'<?xml version="1.0" encoding="UTF-8"?>'
        b'<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
        b"<rootfiles>"
        b'<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
        b"</rootfiles></container>"
    )
    opf = (
        b'<?xml version="1.0" encoding="UTF-8"?>'
        b'<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">'
        b'<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
        b'<dc:identifier id="bookid">fixture</dc:identifier>'
        b"<dc:title>Test Book</dc:title><dc:language>en</dc:language></metadata>"
        b"<manifest>"
        b'<item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>'
        b'<item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>'
        b"</manifest>"
        b'<spine><itemref idref="ch1"/><itemref idref="ch2"/></spine>'
        b"</package>"
    )
    ch1 = (
        b'<?xml version="1.0" encoding="UTF-8"?>'
        b'<html xmlns="http://www.w3.org/1999/xhtml">'
        b"<head><title>Chapter 1</title></head>"
        b"<body><h1>Chapter 1</h1><p>Hello from epub chapter one.</p></body></html>"
    )
    ch2 = (
        b'<?xml version="1.0" encoding="UTF-8"?>'
        b'<html xmlns="http://www.w3.org/1999/xhtml">'
        b"<head><title>Chapter 2</title></head>"
        b"<body><h1>Chapter 2</h1><p>Hello from epub chapter two.</p></body></html>"
    )
    return _zip(
        [
            ("mimetype", mimetype),
            ("META-INF/container.xml", container),
            ("OEBPS/content.opf", opf),
            ("OEBPS/ch1.xhtml", ch1),
            ("OEBPS/ch2.xhtml", ch2),
        ],
        mimetype_stored=True,
    )


def _zip(entries, mimetype_stored=False):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries:
            compress = (
                zipfile.ZIP_STORED
                if (mimetype_stored and name == "mimetype")
                else zipfile.ZIP_DEFLATED
            )
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = compress
            info.external_attr = 0o644 << 16
            zf.writestr(info, data)
    return buf.getvalue()


def main() -> None:
    os.makedirs(FIXTURES, exist_ok=True)
    targets = {
        "sample.pdf": build_pdf(),
        "sample.docx": build_docx(),
        "sample.epub": build_epub(),
    }
    for name, data in targets.items():
        path = os.path.join(FIXTURES, name)
        with open(path, "wb") as fh:
            fh.write(data)
        print(f"wrote {path} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
