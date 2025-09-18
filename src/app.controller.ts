import { Controller, Get, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { sendEmail } from "./shared/services/sendEmail.service";

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getIndexPage(@Res() res: Response): void {
    res.sendFile("index.html", { root: "public" });
  }

  @Post("test-email")
  async testEmail(@Res() res: Response): Promise<void> {
    try {
      await sendEmail({
        emailAddress: "devnaseemkhan@gmail.com",
        subject: "Test Email from NUVISA",
        body: "<h1>Test Email</h1><p>This is a test email to verify email configuration is working correctly.</p>",
      });
      res.json({ success: true, message: "Test email sent successfully!" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
