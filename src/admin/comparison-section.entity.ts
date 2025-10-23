import { Table, Column, Model, DataType, CreatedAt, UpdatedAt } from 'sequelize-typescript';

@Table({
  tableName: 'comparison_sections',
  timestamps: true,
})
export class ComparisonSection extends Model<ComparisonSection> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'Travel Agency',
  })
  title: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'Traditional Agency',
  })
  leftSideTitle: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'NUvisa',
  })
  rightSideTitle: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  leftSideImage: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  rightSideImage: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
  })
  leftSideItems: string[];

  @Column({
    type: DataType.JSON,
    allowNull: false,
  })
  rightSideItems: string[];

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isActive: boolean;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  updatedBy: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}
