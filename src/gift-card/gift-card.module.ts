import { Module } from "@nestjs/common";
import { SequelizeModule } from "@nestjs/sequelize";
import { GiftCard } from "./gift-card.entity";
import { GiftCardService } from "./gift-card.service";
import { GiftCardController } from "./gift-card.controller";

@Module({
  imports: [SequelizeModule.forFeature([GiftCard])],
  controllers: [GiftCardController],
  providers: [GiftCardService],
  exports: [GiftCardService],
})
export class GiftCardModule {}

