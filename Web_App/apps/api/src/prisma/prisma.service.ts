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
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
