import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TeamService } from '../../application/team.service.js';
import { CurrentSalesUser, type SalesUserCtx } from './session.js';

class CreateMemberDto {
  @IsEmail() @MaxLength(200) email: string;
  @IsString() @MinLength(2) @MaxLength(100) fullName: string;
}

class UpdateMemberDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) fullName?: string;
}

/** Satış ekibi kullanıcıları. */
@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(@CurrentSalesUser() me: SalesUserCtx) {
    return this.team.list(me.id);
  }

  @Post()
  create(@CurrentSalesUser() me: SalesUserCtx, @Body() dto: CreateMemberDto) {
    return this.team.create(dto.email, dto.fullName, me.id);
  }

  @Patch(':id')
  update(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.team.update(id, dto, me.id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string) {
    return this.team.resetPassword(id, me.id);
  }

  @Post(':id/reset-2fa')
  @HttpCode(200)
  resetTwoFactor(@CurrentSalesUser() me: SalesUserCtx, @Param('id') id: string) {
    return this.team.resetTwoFactor(id, me.id);
  }
}
