import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  status(): { status: 'ok' | 'degraded'; database: string } {
    const connected = this.connection.readyState === 1;
    return { status: connected ? 'ok' : 'degraded', database: connected ? 'connected' : 'disconnected' };
  }
}
