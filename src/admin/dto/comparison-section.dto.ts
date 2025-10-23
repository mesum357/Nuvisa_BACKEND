import { IsString, IsArray, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateComparisonSectionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  leftSideTitle: string;

  @IsString()
  @IsNotEmpty()
  rightSideTitle: string;

  @IsOptional()
  @IsString()
  leftSideImage?: string;

  @IsOptional()
  @IsString()
  rightSideImage?: string;

  @IsArray()
  @IsString({ each: true })
  leftSideItems: string[];

  @IsArray()
  @IsString({ each: true })
  rightSideItems: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateComparisonSectionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  leftSideTitle?: string;

  @IsOptional()
  @IsString()
  rightSideTitle?: string;

  @IsOptional()
  @IsString()
  leftSideImage?: string;

  @IsOptional()
  @IsString()
  rightSideImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leftSideItems?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rightSideItems?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
