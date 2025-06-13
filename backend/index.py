from py_vapid import Vapid01 as Vapid

vapid_instance = Vapid()
vapid_instance.generate_keys()

private_key = vapid_instance.private_key
public_key = vapid_instance.public_key

print("Please add these two lines to your .env file:")
print("---------------------------------------------")
print(f"VAPID_PRIVATE_KEY={private_key}")
print(f"VAPID_PUBLIC_KEY={public_key}")
