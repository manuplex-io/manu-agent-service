import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor() { }

  @Get('services/health')
  getHealth(@Res() res: Response) {
    return res.status(200).json({ status: 'ok' }); // Returning a 200 OK response for health checks
  }
}
