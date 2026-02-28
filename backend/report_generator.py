from fpdf import FPDF
import os

class PDF(FPDF):
    def header(self):
        self.set_font("Arial", "B", 16)
        self.set_text_color(37, 99, 235)
        self.cell(0, 10, "CareerMatch AI - ATS Analysis Report", ln=True, align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Arial", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def generate_pdf_report(data, output_path):
    pdf = PDF()
    pdf.add_page()
    
    filename = data.get("filename", "Unknown_Resume.pdf")
    predicted_role = data.get("predicted_role", "Not specified")
    ats_score = data.get("ats_score", "N/A")
    extracted_skills = data.get("extracted_skills", [])
    missing_skills = data.get("missing_skills", [])

    pdf.set_font("Arial", "B", 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, f"Candidate File: {filename}", ln=True)
    
    pdf.set_font("Arial", "B", 14)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(0, 10, f"Predicted Role: {predicted_role}", ln=True)
    
    pdf.set_font("Arial", "B", 12)
    if isinstance(ats_score, int) and ats_score < 70:
        pdf.set_text_color(225, 29, 72)
    else:
        pdf.set_text_color(34, 197, 94)
    pdf.cell(0, 10, f"ATS Match Score: {ats_score}%", ln=True)
    pdf.ln(5)

    pdf.set_font("Arial", "B", 12)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 10, "Verified Professional Skills:", ln=True)
    pdf.set_font("Arial", "", 11)
    pdf.set_text_color(100, 116, 139)
    skills_text = ", ".join(extracted_skills) if extracted_skills else "None detected."
    pdf.multi_cell(0, 8, skills_text)
    pdf.ln(5)

    pdf.set_font("Arial", "B", 12)
    pdf.set_text_color(225, 29, 72)
    pdf.cell(0, 10, "Skill Gap Warning (Missing Skills):", ln=True)
    pdf.set_font("Arial", "", 11)
    pdf.set_text_color(100, 116, 139)
    missing_text = ", ".join(missing_skills) if missing_skills else "None! You are a perfect match."
    pdf.multi_cell(0, 8, missing_text)
    
    pdf.output(output_path)