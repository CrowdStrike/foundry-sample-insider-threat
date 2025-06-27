from crowdstrike.foundry.function import Function, Request, Response, APIError
from falconpy import IdentityProtection

func = Function.instance()


@func.handler(method='GET', path='/linked-accounts')
def get_linked_accounts(request: Request, config: [dict[str, any], None]) -> Response:
    try:
        # Getting input variables
        entityId = request.body.get("EntityId")        
        
        # Initialize client without explicit authentication parameters
        falcon = IdentityProtection()

        idp_query='''query ($entityId: UUID!) {
  entities(associationQuery: {bindingTypes: [LINKED_ACCOUNT], entityQuery: {entityIds: [$entityId]}}, first: 100) {
    nodes {
      entityId
      accounts {
        ... on ActiveDirectoryAccountDescriptor {
          objectSid
          domain
        }
      }
    }
  }
}
'''
        variables=f'{{"entityId": "{entityId}"}}'

        response = falcon.graphql(query=idp_query, variables=variables)
            
        if response.get("status_code") != 200:
            return Response(
            code=response.get("status_code"),
            errors=[APIError(code=response.get("status_code"), message=response.get("body").get("errors")[0].get("message"))],
        )
            
        entities=response.get("body").get("data").get("entities").get("nodes")
        
        linked_entities = []
        
        for entity in entities:
            for account in entity.get("accounts"):
                linked_entity= {
                    "EntitySid" : account.get("objectSid"),
                    "EntityId" :  entity.get("entityId"),
                    "Domain" : account.get("domain")                    
                }
                linked_entities.append(linked_entity)
                

        # Prepare response body
        body = {
          "linked_entities" : linked_entities
        }

        return Response(
            body=body,
            code=200,
        )
    
    except Exception as e:
        return Response(
            code=500,
            errors=[APIError(code=500, message=f"Internal server error: {str(e)}")],
        )


if __name__ == '__main__':
    func.run()
