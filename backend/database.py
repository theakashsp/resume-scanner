from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["resume_scanner_db"]
collection = db["candidates"]


def save_candidate(data):
    existing = collection.find_one({"filename": data["filename"]})
    
    if existing:
        collection.update_one(
            {"filename": data["filename"]},
            {"$set": data}
        )
    else:
        collection.insert_one(data)



def get_all_candidates():
    return list(collection.find({}, {"_id": 0}))

def delete_all_candidates():
    print("Clearing candidates collection...")
    collection.delete_many({})
def save_candidate(candidate):
    result = collection.insert_one(candidate)
    candidate["_id"] = str(result.inserted_id)
    return candidate

