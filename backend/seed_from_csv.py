import csv
from pymongo import MongoClient

# 1. Connect to MongoDB
client = MongoClient("mongodb://localhost:27017/")
db = client["resume_scanner_db"]
roles_collection = db["roles"]

def seed_database_from_csv(csv_filepath):
    print("🧹 Clearing old roles...")
    roles_collection.delete_many({}) 
    
    new_roles = []
    
    try:
        with open(csv_filepath, mode='r', encoding='utf-8-sig') as file:
            reader = csv.DictReader(file)
            
            print(f"🔍 Found headers: {reader.fieldnames}")
            
            for row in reader:
                # Normalize all column names to lowercase and strip hidden spaces
                clean_row = {str(k).strip().lower(): str(v).strip() for k, v in row.items() if k is not None}
                
                # ✨ THE MAGIC FIX IS HERE ✨
                # We tell Python: "Look for 'role'. If it's not there, grab 'job_title'!"
                role_name = clean_row.get("role", clean_row.get("job_title", ""))
                skills_string = clean_row.get("skills", "")
                
                skills_list = [skill.strip().lower() for skill in skills_string.split(",") if skill.strip()]
                
                if role_name and skills_list:
                    new_roles.append({
                        "role": role_name,
                        "skills": skills_list
                    })
                    
        # 3. Insert into MongoDB
        if new_roles:
            roles_collection.insert_many(new_roles)
            print(f"✅ Successfully inserted {len(new_roles)} roles into MongoDB!")
        else:
            print("⚠️ No valid data found in the CSV. Look at the 'Found headers' line above to see what went wrong.")
            
    except FileNotFoundError:
        print(f"❌ Error: Could not find the file '{csv_filepath}'. Make sure it is in the backend folder.")

if __name__ == "__main__":
    seed_database_from_csv("tech_roles.csv")