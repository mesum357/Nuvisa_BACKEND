import { Table, Column,  Model,  DataType,  PrimaryKey,  Default,  AllowNull, ForeignKey} from 'sequelize-typescript';
import {User} from '../auth/auth.entity';

@Table({ tableName: 'payment', timestamps: true })
export class Payment extends Model<Payment> {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @AllowNull(false)
    @Column({ type: DataType.UUID })
    id: string;


    @AllowNull(false)
    @ForeignKey(() => User)
    @Column({ type: DataType.UUID })
    user_id: string;


    @AllowNull(false)
    @Column({ type: DataType.STRING })
    email: string;

   
    @AllowNull(false)
    @Column({ type: DataType.STRING })
    sessionId: string;
  
     
    @AllowNull(false)
    @Default(false)
    @Column({ type: DataType.BOOLEAN })
    isPaid: boolean;
  
  
    @AllowNull(true)
    @Column({ type: DataType.STRING })
    membershipPlan: string;
  

    @AllowNull(true)
    @Column({ type: DataType.STRING })
    subscriptionId: string;
  
  
    @AllowNull(true)
    @Column({ type: DataType.STRING })
    subscriptionStatus: string;
    
  
    @AllowNull(true)
    @Default(null)
    @Column({ type: DataType.STRING })
    subscription_start_date: string;
  



}
