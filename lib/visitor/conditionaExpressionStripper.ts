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

  isBinaryExpression(
    expression: Types.Expression | undefined,
  ): expression is Types.BinaryExpression {
    if (!expression) {
      return false;
    }

    return expression.type === "BinaryExpression";
  }

  isIdentifier(expression: Types.Expression): expression is Types.Identifier {
    return expression.type === "Identifier";
  }

  visitTsType(type: Types.TsType): Types.TsType {
    return type;
  }

  #testIdentifiersMatch(
    identifier1: Types.Identifier,
    identifier2: Types.Identifier,
  ) {
    return identifier1.value === identifier2.value;
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
  ) {
    if (this.isIdentifier(exp1) && this.isIdentifier(exp2)) {
      return this.#testIdentifiersMatch(exp1, exp2);
    }

    if (exp1.type === "StringLiteral" && exp2.type === "StringLiteral") {
      return this.#testStringLiteralsMatch(exp1, exp2);
    }

    return false;
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
