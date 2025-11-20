import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  Index,
} from "sequelize-typescript";

@Table({ tableName: "email_logs", timestamps: true })
export class EmailLog extends Model<EmailLog> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @AllowNull(false)
  @Column({ type: DataType.UUID })
  id: string;

  @Index
  @AllowNull(false)
  @Column({ type: DataType.STRING })
  recipientEmail: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  recipientName: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  subject: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  body: string;

  @AllowNull(false)
  @Column({ type: DataType.TEXT })
  htmlContent: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  templateKey: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  templateName: string;

  @AllowNull(true)
  @Column({ type: DataType.JSONB })
  templateVariables: any;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  applicationId: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  userId: string;

  @Default('sent')
  @AllowNull(false)
  @Column({ type: DataType.STRING })
  status: string; // 'sent', 'failed', 'pending'

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  errorMessage: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  messageId: string; // Email provider message ID

  @Column({ type: DataType.DATE, field: "createdAt" })
  createdAt: Date;

  @Column({ type: DataType.DATE, field: "updatedAt" })
  updatedAt: Date;
}

