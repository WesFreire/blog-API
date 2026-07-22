import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { AccessTokenGuard } from '../access-token/access-token.guard';
import { OptionalAccessTokenGuard } from '../optional-access-token/optional-access-token.guard';
import { AuthType } from 'src/auth/enum/auth-type.enum';
import { AUTH_TYPE_KEY } from 'src/auth/constants/auth.constants';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private static readonly defaultAuthType = AuthType.Bearer

  private readonly authTypeGuardMap: Record<
    AuthType,
    CanActivate | CanActivate[]
  > = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.None]: { canActivate: () => true },
      [AuthType.Optional]: this.optionalAccessTokenGuard,
    }
  constructor(
    private readonly reflector: Reflector,

    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly optionalAccessTokenGuard: OptionalAccessTokenGuard,
  ) { }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    // authType from reflector
    const authTypes = this.reflector.getAllAndOverride(
      AUTH_TYPE_KEY,
      [context.getHandler(), context.getClass()]
    ) ?? [AuthenticationGuard.defaultAuthType]

    // array of guards
    const guards = authTypes.map((type) => this.authTypeGuardMap[type]).flat()

    // default error
    const error = new UnauthorizedException()

    // loop guards canActivate
    for (const instance of guards) {

      const canActivate = await Promise.resolve(
        instance.canActivate(context)
      ).catch((err) => {
        error: err
      })

      if (canActivate) {
        return true
      }
    }

    throw error;
  }
}
