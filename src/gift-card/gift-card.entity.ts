import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  Unique,
} from "sequelize-typescript";

@Table({ tableName: "gift_cards", timestamps: true })
export class GiftCard extends Model<GiftCard> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @AllowNull(false)
  @Column({ type: DataType.UUID })
  id: string;

  @AllowNull(false)
  @Unique
  @Column({ type: DataType.STRING })
  code: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  email: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  stripe_session_id: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  stripe_payment_intent_id: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  amount: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column({ type: DataType.DATE })
  purchased_at: Date;

  @AllowNull(true)
  @Column({ type: DataType.DATE })
  used_at: Date;

  @AllowNull(true)
  @Column({ type: DataType.UUID })
  used_by_user_id: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING })
  used_by_email: string;

  @AllowNull(false)
  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  is_used: boolean;

  @AllowNull(true)
  @Column({ type: DataType.INTEGER })
  quantity: number;

  @AllowNull(true)
  @Column({ type: DataType.UUID })
  purchase_group_id: string;
}

