from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import os

def generate_pdf_report(data, output_path):
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter

    y = height - 40

    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "AI Resume Evaluation Report")
    y -= 40

    c.setFont("Helvetica", 12)

    c.drawString(50, y, f"Filename: {data['filename']}")
    y -= 25

    c.drawString(50, y, f"Match Percentage: {data['match_percentage']}%")
    y -= 25

    c.drawString(50, y, f"Status: {data['status']}")
    y -= 25

    y -= 10
    c.drawString(50, y, "Matched Skills:")
    y -= 20

    for skill in data.get("matched_skills", []):
        c.drawString(70, y, f"- {skill}")
        y -= 18

    y -= 10
    c.drawString(50, y, "Missing Skills:")
    y -= 20

    for skill in data.get("missing_skills", []):
        c.drawString(70, y, f"- {skill}")
        y -= 18

    c.save()
