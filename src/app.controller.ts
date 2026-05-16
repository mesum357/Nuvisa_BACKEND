import { Controller, Get, Post, Body, Res } from "@nestjs/common";
import { Response } from "express";
import { sendEmail } from "./shared/services/sendEmail.service";
import { AdminService } from "./admin/admin.service";

@Controller()
export class AppController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  getIndexPage(@Res() res: Response): void {
    res.sendFile("index.html", { root: "public" });
  }

  @Post("feedback")
  async submitFeedback(
    @Body()
    body: { name?: string; email: string; message: string; rating?: number }
  ) {
    if (!body?.email?.trim() || !body?.message?.trim()) {
      return { success: false, message: "Email and message are required" };
    }
    const result = await this.adminService.submitFeedback({
      name: body.name,
      email: body.email.trim(),
      message: body.message.trim(),
      rating: body.rating,
    });
    return { success: true, data: result };
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
