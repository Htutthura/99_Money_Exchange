import requests
import json

# First, test login
print("Testing authentication...")
login_data = {
    'username': 'admin',
    'password': 'admin123'
}

try:
    # Test login
    login_response = requests.post(
        'http://localhost:8000/api/v1/auth/login/', 
        json=login_data, 
        headers={'Content-Type': 'application/json'}
    )
    print(f'Login Status Code: {login_response.status_code}')
    print(f'Login Response: {login_response.text}')
    
    if login_response.status_code == 200:
        print("✅ Authentication successful!")
        auth_data = login_response.json()
        token = auth_data['token']
        print(f"Auth Token: {token}")
        
        # Now test creating a transaction with authentication
        transaction_data = {
            'transaction_type': 'BUY',
            'customer_name': 'Test Customer',
            'source_currency': 12,  # MMK currency ID
            'target_currency': 11,  # THB currency ID  
            'source_amount': 3650.0,
            'target_amount': 100.0,
            'rate': 36.5,
        }
        
        print("\nTesting authenticated transaction creation...")
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Token {token}'
        }
        
        transaction_response = requests.post(
            'http://localhost:8000/api/v1/transactions/', 
            json=transaction_data, 
            headers=auth_headers
        )
        print(f'Transaction Status Code: {transaction_response.status_code}')
        print(f'Transaction Response: {transaction_response.text}')
        
        if transaction_response.status_code == 201:
            print("✅ Authenticated transaction created successfully!")
        else:
            print("❌ Authenticated transaction creation failed!")
            
        # Test accessing transactions without authentication
        print("\nTesting unauthenticated access...")
        unauth_response = requests.get('http://localhost:8000/api/v1/transactions/')
        print(f'Unauthenticated Status Code: {unauth_response.status_code}')
        if unauth_response.status_code == 401:
            print("✅ Unauthenticated access properly blocked!")
        else:
            print("❌ Security issue: Unauthenticated access allowed!")
            
    else:
        print("❌ Authentication failed!")
        
except Exception as e:
    print(f'Error: {e}') 