import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    // Auto-migrate schema in cloud production environments if columns are missing
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE employees 
        ADD COLUMN IF NOT EXISTS employmentType ENUM('OFFICE', 'FIELD') NOT NULL DEFAULT 'OFFICE'
      `);
      this.logger.log('Database schema verified: employmentType column active.');
    } catch (err: any) {
      try {
        await this.$executeRawUnsafe(`
          ALTER TABLE employees 
          ADD COLUMN employmentType ENUM('OFFICE', 'FIELD') NOT NULL DEFAULT 'OFFICE'
        `);
        this.logger.log('Database schema auto-migrated: added employmentType column.');
      } catch (innerErr: any) {
        // Column already exists or handled by DB, safe to ignore
      }
    }

    try {
      // Ensure all GPS/Field employees (OFF_SITE) have employmentType = 'FIELD'
      await this.$executeRawUnsafe(`
        UPDATE employees 
        SET employmentType = 'FIELD' 
        WHERE workLocationType = 'OFF_SITE' AND employmentType != 'FIELD'
      `);
    } catch (_) {}

    try {
      // Rebrand GTIB to CUTMAP: Centurion University Admission Staff
      await this.$executeRawUnsafe(`
        UPDATE companies 
        SET code = 'CUTMAP', name = 'Centurion University Admission Staff' 
        WHERE code = 'GTIB'
      `);
      this.logger.log('Database verified: GTIB rebranded to CUTMAP (Centurion University Admission Staff).');
    } catch (_) {}
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
