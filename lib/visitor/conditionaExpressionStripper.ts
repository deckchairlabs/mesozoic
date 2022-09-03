import { Types, Visitor } from "../swc.ts";

export class ConditionalExpressionStripperVisitor extends Visitor {
  constructor(private conditional: Types.ExpressionStatement | undefined) {
    super();
  }

  visitIfStatement(statement: Types.IfStatement): Types.Statement {
    if (this.conditional) {
      let replaceStatement = false;

      if (
        this.isBinaryExpression(statement.test) &&
        this.isBinaryExpression(this.conditional.expression)
      ) {
        replaceStatement = this.#testBinaryExpressionAgainstConditional(
          statement.test,
          this.conditional.expression,
        );
      } else if (
        this.isIdentifier(statement.test) &&
        this.isIdentifier(this.conditional.expression)
      ) {
        replaceStatement = this.#testIdentifiersMatch(
          statement.test,
          this.conditional.expression,
        );
      } else if (
        this.isMemberExpression(statement.test) &&
        this.isMemberExpression(this.conditional.expression)
      ) {
        replaceStatement = this.#testMemberExpressionAgainstConditional(
          statement.test,
          this.conditional.expression,
        );
      }

      if (replaceStatement) {
        /**
         * If the IfStatement has an alternative branch eg. "else"
         * return that instead.
         */
        if (statement.alternate) {
          return statement.alternate;
        }

        // Otherwise just return an empty statement
        return {
          type: "EmptyStatement",
          span: statement.span,
        };
      }
    }

    return super.visitIfStatement(statement);
  }

  visitTsType(type: Types.TsType): Types.TsType {
    return type;
  }

  isBinaryExpression(
    expression: Types.Expression | undefined,
  ): expression is Types.BinaryExpression {
    if (!expression) {
      return false;
    }

    return expression.type === "BinaryExpression";
  }

  isMemberExpression(
    expression: Types.Expression | undefined,
  ): expression is Types.MemberExpression {
    if (!expression) {
      return false;
    }

    return expression.type === "MemberExpression";
  }

  isIdentifier(
    expression: Types.Expression | Types.ComputedPropName,
  ): expression is Types.Identifier {
    return expression.type === "Identifier";
  }

  isStringLiteral(
    expression: Types.Expression,
  ): expression is Types.StringLiteral {
    return expression.type === "StringLiteral";
  }

  #testIdentifiersMatch(
    exp1: Types.Expression | Types.PrivateName | Types.ComputedPropName,
    exp2: Types.Expression | Types.PrivateName | Types.ComputedPropName,
  ) {
    if (this.isIdentifier(exp1) && this.isIdentifier(exp2)) {
      return exp1.value === exp2.value;
    }

    return false;
  }

  #testStringLiteralsMatch(
    literal1: Types.StringLiteral,
    literal2: Types.StringLiteral,
  ) {
    return literal1.value === literal2.value;
  }

  #testExpressionsMatch(
    exp1: Types.Expression,
    exp2: Types.Expression,
  ): boolean {
    if (this.isIdentifier(exp1) && this.isIdentifier(exp2)) {
      return this.#testIdentifiersMatch(exp1, exp2);
    }

    if (this.isStringLiteral(exp1) && this.isStringLiteral(exp2)) {
      return this.#testStringLiteralsMatch(exp1, exp2);
    }

    if (this.isMemberExpression(exp1) && this.isMemberExpression(exp2)) {
      return this.#testExpressionsMatch(exp1, exp2);
    }

    return false;
  }

  #testMemberExpressionAgainstConditional(
    expression: Types.MemberExpression,
    conditional: Types.MemberExpression,
  ) {
    return [
      this.#testIdentifiersMatch(expression.object, conditional.object),
      this.#testIdentifiersMatch(expression.property, conditional.property),
    ].every((value) => value);
  }

  #testBinaryExpressionAgainstConditional(
    expression: Types.BinaryExpression,
    conditional: Types.BinaryExpression,
  ) {
    return [
      expression.operator === conditional.operator,
      this.#testExpressionsMatch(expression.left, conditional.left),
      this.#testExpressionsMatch(expression.right, conditional.right),
    ].every((value) => value === true);
  }
}
