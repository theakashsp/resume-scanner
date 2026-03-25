from pymongo import MongoClient

# Connect to your local MongoDB (Update this string later if you use MongoDB Atlas)
client = MongoClient("mongodb://localhost:27017/")
db = client["resume_scanner_db"] # Your database name
roles_collection = db["roles"]   # New collection specifically for job roles

# Expanded list of modern tech roles
ROLES_DATA = [
    {"role": "Machine Learning Engineer", "skills": ["python", "tensorflow", "pytorch", "sql", "docker", "aws", "pandas", "machine learning", "data science", "opencv", "yolo"]},
    {"role": "Full Stack Developer", "skills": ["react", "node.js", "javascript", "mongodb", "docker", "aws", "typescript", "html", "css", "fastapi", "django"]},
    {"role": "Backend Developer", "skills": ["python", "java", "node.js", "sql", "postgresql", "mongodb", "api", "docker", "aws", "django", "fastapi", "spring boot"]},
    {"role": "Frontend Developer", "skills": ["react", "javascript", "typescript", "html", "css", "vue", "angular", "tailwind"]},
    {"role": "Data Analyst", "skills": ["sql", "excel", "python", "tableau", "powerbi", "statistics", "data analysis"]},
    {"role": "DevOps Engineer", "skills": ["aws", "docker", "kubernetes", "linux", "ci/cd", "terraform", "python", "jenkins"]},
    {"role": "Cloud Engineer", "skills": ["aws", "azure", "gcp", "docker", "kubernetes", "linux", "terraform"]},
    {"role": "Security Engineer", "skills": ["cybersecurity", "linux", "network security", "penetration testing", "cryptography", "python", "ethical hacking"]},
    {"role": "Software Developer", "skills": ["java", "c++", "python", "data structures", "algorithms", "sql", "git", "c"]},
    
    # --- NEW EXPANDED ROLES ---
    {"role": "Mobile App Developer", "skills": ["flutter", "dart", "react native", "swift", "kotlin", "java", "firebase", "android", "ios"]},
    {"role": "Data Engineer", "skills": ["python", "sql", "spark", "hadoop", "kafka", "aws", "airflow", "etl", "snowflake"]},
    {"role": "Blockchain Engineer", "skills": ["solidity", "smart contracts", "ethereum", "web3", "rust", "go", "cryptography"]},
    {"role": "Game Developer", "skills": ["c#", "c++", "unity", "unreal engine", "3d modeling", "game design"]},
    {"role": "UI/UX Designer", "skills": ["figma", "adobe xd", "wireframing", "prototyping", "html", "css", "user research"]},
    {"role": "Embedded Systems Engineer", "skills": ["c", "c++", "microcontrollers", "rtos", "iot", "linux", "hardware", "assembly"]}
]

def seed_database():
    print("Clearing old roles...")
    roles_collection.delete_many({}) # Clear existing roles to prevent duplicates
    
    print(f"Inserting {len(ROLES_DATA)} roles into MongoDB...")
    roles_collection.insert_many(ROLES_DATA)
    
    print("✅ Database successfully seeded! Your AI now knows more jobs.")

if __name__ == "__main__":
    seed_database()