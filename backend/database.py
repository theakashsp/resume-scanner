import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# ======================================================
# 🔐 DATABASE CONNECTION CONFIGURATION
# ======================================================
# It will use your Cloud DB if you set an environment variable, 
# otherwise, it safely falls back to your local MongoDB for testing.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")

DB_NAME = "careermatch_ai_db"
COLLECTION_NAME = "candidates"

print("⏳ Initializing Database Connection...")

try:
    # Set a 5-second timeout so it doesn't hang forever if the DB is offline
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    
    # Force a ping to confirm the connection is actually alive
    client.admin.command('ping')
    print("✅ Successfully locked into MongoDB!")
    
except ConnectionFailure:
    print("❌ CRITICAL: Failed to connect to MongoDB. Make sure MongoDB is running locally or your Cloud URI is correct.")

# Connect to the specific database and collection
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# ======================================================
# 💾 DATA STORAGE FUNCTIONS
# ======================================================
def save_candidate(data: dict):
    """
    Saves the analyzed resume profile securely to the database.
    This tracks the filename, skills, predicted role, and ATS score.
    """
    try:
        result = collection.insert_one(data)
        print(f"💾 Profile securely saved to DB with ID: {result.inserted_id}")
        return True
    except Exception as e:
        print(f"⚠️ Database Error: {e}")
        return False