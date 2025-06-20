import requests
import json

print("🔐 Testing Authentication System")
print("=" * 50)

BASE_URL = "http://localhost:8000/api/v1"

def test_login():
    """Test login functionality"""
    print("\n1️⃣ Testing Login...")
    
    login_data = {
        'username': 'admin',
        'password': 'admin123'
    }
    
    response = requests.post(f'{BASE_URL}/auth/login/', json=login_data)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Login Successful!")
        print(f"   Token: {data['token'][:20]}...")
        print(f"   Username: {data['username']}")
        print(f"   Is Staff: {data['is_staff']}")
        return data['token']
    else:
        print(f"❌ Login Failed: {response.text}")
        return None

def test_unauthenticated_access():
    """Test that unauthenticated requests are blocked"""
    print("\n2️⃣ Testing Unauthenticated Access...")
    
    response = requests.get(f'{BASE_URL}/transactions/')
    print(f"Status Code: {response.status_code}")
    
    if response.status_code in [401, 403]:
        print("✅ Unauthenticated access properly blocked!")
        return True
    else:
        print("❌ Security issue: Unauthenticated access allowed!")
        return False

def test_authenticated_access(token):
    """Test that authenticated requests work"""
    print("\n3️⃣ Testing Authenticated Access...")
    
    headers = {'Authorization': f'Token {token}'}
    response = requests.get(f'{BASE_URL}/transactions/', headers=headers)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Authenticated access successful!")
        data = response.json()
        print(f"   Retrieved {data.get('count', 0)} transactions")
        return True
    else:
        print(f"❌ Authenticated access failed: {response.text}")
        return False

def test_user_profile(token):
    """Test user profile endpoint"""
    print("\n4️⃣ Testing User Profile...")
    
    headers = {'Authorization': f'Token {token}'}
    response = requests.get(f'{BASE_URL}/auth/profile/', headers=headers)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ User profile retrieved!")
        print(f"   User ID: {data['user_id']}")
        print(f"   Username: {data['username']}")
        print(f"   Is Staff: {data['is_staff']}")
        return True
    else:
        print(f"❌ Profile access failed: {response.text}")
        return False

def test_logout(token):
    """Test logout functionality"""
    print("\n5️⃣ Testing Logout...")
    
    headers = {'Authorization': f'Token {token}'}
    response = requests.post(f'{BASE_URL}/auth/logout/', headers=headers)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Logout successful!")
        
        # Test that token is now invalid
        print("   Verifying token invalidation...")
        test_response = requests.get(f'{BASE_URL}/transactions/', headers=headers)
        if test_response.status_code in [401, 403]:
            print("   ✅ Token properly invalidated!")
            return True
        else:
            print("   ❌ Token still valid after logout!")
            return False
    else:
        print(f"❌ Logout failed: {response.text}")
        return False

# Run all tests
def main():
    try:
        # Test 1: Login
        token = test_login()
        if not token:
            print("\n❌ Cannot continue without valid token")
            return
        
        # Test 2: Unauthenticated access
        test_unauthenticated_access()
        
        # Test 3: Authenticated access
        test_authenticated_access(token)
        
        # Test 4: User profile
        test_user_profile(token)
        
        # Test 5: Logout
        test_logout(token)
        
        print("\n" + "=" * 50)
        print("🎉 Authentication testing complete!")
        print("✅ Your API is now secured with authentication!")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")

if __name__ == "__main__":
    main() 