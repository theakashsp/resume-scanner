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
    
    # 2. Read the CSV File
    try:
        with open(csv_filepath, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row in reader:
                role_name = row.get("Role", "").strip()
                # Split the comma-separated string into a proper Python list
                skills_string = row.get("Skills", "")
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
            print("⚠️ No valid data found in the CSV.")
            
    except FileNotFoundError:
        print(f"❌ Error: Could not find the file '{csv_filepath}'. Make sure it is in the backend folder.")

if __name__ == "__main__":
    # Make sure you have a file named tech_roles.csv in the same folder
    seed_database_from_csv("tech_roles.csv")