import sqlite3
conn = sqlite3.connect("db.sqlite3")
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM transactions_transaction")
total = cursor.fetchone()[0]
print(f"Total transactions: {total}")
if total > 0:
    cursor.execute("SELECT MIN(date), MAX(date) FROM transactions_transaction")
    min_date, max_date = cursor.fetchone()
    print(f"Date range: {min_date} to {max_date}")
    cursor.execute("SELECT date, COUNT(*) FROM transactions_transaction GROUP BY date ORDER BY date DESC LIMIT 10")
    print("Recent dates:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} transactions")
conn.close()
