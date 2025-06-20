from django.core.management.base import BaseCommand
from django.core.serializers import serialize
from django.apps import apps
from django.conf import settings
import json
import os
import datetime
import subprocess
from pathlib import Path

class Command(BaseCommand):
    help = 'Create database backup for 99 Money Exchange App'

    def add_arguments(self, parser):
        parser.add_argument(
            '--format',
            type=str,
            choices=['sql', 'json', 'both'],
            default='both',
            help='Backup format: sql, json, or both'
        )
        parser.add_argument(
            '--output-dir',
            type=str,
            default='backups',
            help='Output directory for backups'
        )

    def handle(self, *args, **options):
        backup_format = options['format']
        output_dir = Path(options['output_dir'])
        output_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        self.stdout.write(
            self.style.SUCCESS(f'🛡️ Starting backup for 99 Money Exchange App - {timestamp}')
        )
        
        if backup_format in ['sql', 'both']:
            self.create_sql_backup(output_dir, timestamp)
            
        if backup_format in ['json', 'both']:
            self.create_json_backup(output_dir, timestamp)
            
        self.stdout.write(
            self.style.SUCCESS('✅ Backup completed successfully!')
        )

    def create_sql_backup(self, output_dir, timestamp):
        """Create PostgreSQL dump backup"""
        backup_file = output_dir / f"money_exchange_sql_{timestamp}.sql"
        
        # Get database URL from settings
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            self.stdout.write(
                self.style.ERROR('❌ DATABASE_URL not found in environment variables')
            )
            return
            
        try:
            # Create SQL dump
            cmd = ['pg_dump', database_url, '--no-password', '--verbose']
            
            with open(backup_file, 'w') as f:
                result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True)
                
            if result.returncode == 0:
                file_size = backup_file.stat().st_size / 1024  # KB
                self.stdout.write(
                    self.style.SUCCESS(f'✅ SQL backup created: {backup_file} ({file_size:.1f} KB)')
                )
            else:
                self.stdout.write(
                    self.style.ERROR(f'❌ SQL backup failed: {result.stderr}')
                )
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ SQL backup error: {str(e)}')
            )

    def create_json_backup(self, output_dir, timestamp):
        """Create JSON export of critical data"""
        backup_file = output_dir / f"money_exchange_json_{timestamp}.json"
        
        try:
            # Get all models from both apps
            api_models = apps.get_app_config('api').get_models()
            transaction_models = apps.get_app_config('transactions').get_models()
            
            backup_data = {
                "backup_info": {
                    "timestamp": timestamp,
                    "version": "1.0",
                    "type": "json_export",
                    "app_version": "99_money_exchange_v1.0"
                },
                "data": {}
            }
            
            # Export API models
            for model in api_models:
                model_name = model._meta.label_lower.replace('.', '_')
                queryset = model.objects.all()
                if queryset.exists():
                    serialized_data = serialize('json', queryset)
                    backup_data["data"][model_name] = json.loads(serialized_data)
                    
                    self.stdout.write(f"📊 Exported {queryset.count()} {model_name} records")
            
            # Export transaction models
            for model in transaction_models:
                model_name = model._meta.label_lower.replace('.', '_')
                queryset = model.objects.all()
                if queryset.exists():
                    serialized_data = serialize('json', queryset)
                    backup_data["data"][model_name] = json.loads(serialized_data)
                    
                    self.stdout.write(f"📊 Exported {queryset.count()} {model_name} records")
            
            # Write JSON file
            with open(backup_file, 'w') as f:
                json.dump(backup_data, f, indent=2, default=str)
            
            file_size = backup_file.stat().st_size / 1024  # KB
            total_records = sum(len(data) for data in backup_data["data"].values() if isinstance(data, list))
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ JSON backup created: {backup_file} ({file_size:.1f} KB, {total_records} records)'
                )
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ JSON backup error: {str(e)}')
            ) 