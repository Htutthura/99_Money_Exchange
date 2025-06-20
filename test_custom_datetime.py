import requests
import json
from datetime import datetime, timedelta

def test_custom_datetime():
    # Test data with custom datetime
    custom_datetime = datetime.now() - timedelta(days=1, hours=2)
    formatted_datetime = custom_datetime.isoformat()
    
    test_data = {
        'transaction_type': 'BUY',
        'customer': 'Test Customer',
        'thb_amount': 100.00,
        'mmk_amount': 3650.00,
        'rate': 36.50,
        'hundred_k_rate': 2739.73,
        'profit': 0,
        'created_at': formatted_datetime
    }
    
    print(f"Testing custom datetime API call...")
    print(f"Custom datetime: {formatted_datetime}")
    print(f"Test data: {json.dumps(test_data, indent=2)}")
    
    try:
        response = requests.post(
            'http://localhost:8000/api/transactions/create/',
            headers={'Content-Type': 'application/json'},
            data=json.dumps(test_data)
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 201:
            response_data = response.json()
            print(f"Success! Response data: {json.dumps(response_data, indent=2)}")
            print(f"Returned date_time: {response_data.get('date_time', 'NOT FOUND')}")
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("Connection error - make sure the backend server is running on localhost:8000")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_custom_datetime() 